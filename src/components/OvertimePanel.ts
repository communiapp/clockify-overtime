import { generatePDF, requestAndCalculateOvertime } from '@/calculate';
import { overtimeCarryover } from '@/overtimeCarryover';
import { RuleObject } from 'ant-design-vue/lib/form/interface';
import moment, { Moment } from 'moment';
import { defineComponent, reactive, ref, toRaw, UnwrapRef, watch } from 'vue';
import { AllUsersResponse, ClockifyWorkspace, getAllUsers, getCurrentUser, getWorkspaces } from '../clockifyApi';

interface HoursPerWeek {
  id: string;
  hoursPerWeek: number;
}
interface FormState {
  apiKey: string;
  workspace?: string;
  period?: Moment[];
  workingDays: number[];
  workingDaysPreset: object;
  workingHours: number;
  workspaces: ReadonlyArray<ClockifyWorkspace>;
  userAvatarUrl?: string;
  currentUserId?: string;
  userId?: string;
  users: ReadonlyArray<AllUsersResponse>;
  isAdmin?: boolean;
  overtime?: {
    businessHours: number;
    allocatedHours: number;
    overtimeHours: number;
    carryoverHours: number;
    totalOvertimeHours: number;
    isOver?: boolean;
    missingDates: string[];
  };
  weeklyHoursByUser: Array<HoursPerWeek>;
}

interface SavedState {
  apiKey: string;
  workingHours: number;
  workingDays: number[];
}

export default defineComponent({
  name: 'OvertimePanel',
  setup() {
    const savedValuesJSON = localStorage.getItem('overtimeFormState');
    const savedValues = savedValuesJSON ? (JSON.parse(savedValuesJSON) as SavedState) : undefined;

    const formRef = ref();
    const formState: UnwrapRef<FormState> = reactive({
      apiKey: savedValues?.apiKey || '',
      period: [moment().startOf('year'), moment()],
      workingHours: savedValues?.workingHours || 40,
      workingDays: savedValues?.workingDays || [1, 2, 3, 4, 5],
      workingDaysPreset: [
        { name: 'Monday', id: 1 },
        { name: 'Tuesday', id: 2 },
        { name: 'Wednesday', id: 3 },
        { name: 'Thursday', id: 4 },
        { name: 'Friday', id: 5 }
      ],
      workspaces: [],
      users: [],
      weeklyHoursByUser: []
    });
    const readWorkspaces = async (apiKey: string) => {
      const currentUser = await getCurrentUser(apiKey);
      const workspaces = await getWorkspaces(apiKey);
      formState.currentUserId = currentUser.id;
      formState.userId = currentUser.id;
      formState.workspaces = workspaces;
      formState.workspace = currentUser.activeWorkspace;
      formState.userAvatarUrl = currentUser.profilePicture;
    };
    const readUsers = async (workspaceId: string) => {
      const users = await getAllUsers(formState.apiKey, workspaceId);
      formState.users = users;
      formState.isAdmin = users.find((user) => user.id === formState.currentUserId)?.roles.some((role) => role.role === 'WORKSPACE_ADMIN');
    };
    watch(
      () => formState.workspace,
      async (worspaceId) => {
        if (worspaceId && formState.currentUserId && formState.apiKey) {
          formState.userId = formState.currentUserId;
          try {
            await readUsers(worspaceId);
          } catch (err) {
            console.error(err.message);
          }
        }
      }
    );

    const changeUser = function (user: string) {
      //only needs to be defined if weekly hours is != 40
      const weeklyHoursByUser: Array<HoursPerWeek> = [
        { id: '61f92781ac89702589768bb9', hoursPerWeek: 8.6 },
        { id: '6180ff00f9914c556e304294', hoursPerWeek: 19 },
        { id: '6156ba67d46cbb188cf768d7', hoursPerWeek: 1.97 },
        { id: '6156ba5ab89747128196a7e9', hoursPerWeek: 10 },
        { id: '615ab7b9bed77c3f3e9743e8', hoursPerWeek: 8.6 },
        { id: '67a247e19a004c22985ca0d8', hoursPerWeek: 9.89 }
      ];

      const userSpecificHours = weeklyHoursByUser.find((item) => item.id === user);
      if (userSpecificHours && userSpecificHours.hoursPerWeek) {
        formState.workingHours = userSpecificHours.hoursPerWeek;
      } else {
        formState.workingHours = 40;
      }
    };

    const validateApiKey = async (rule: RuleObject, value: string) => {
      if (value) {
        try {
          await readWorkspaces(value);
        } catch (err) {
          throw new Error(err.message);
        }
      }
    };
    if (formState.apiKey) {
      //TODO how to do this properly?
      setTimeout(() => formRef.value.validateFields('apiKey'), 100);
    }

    const onSubmit = async () => {
      console.log('submit!', toRaw(formState));
      const valuesToSave: SavedState = {
        apiKey: formState.apiKey,
        workingHours: formState.workingHours,
        workingDays: formState.workingDays
      };
      localStorage.setItem('overtimeFormState', JSON.stringify(valuesToSave));

      if (formState.userId && formState.workspace && formState.period) {
        const result = await requestAndCalculateOvertime(
          formState.apiKey,
          formState.userId,
          formState.workspace,
          formState.period[0].toDate(),
          formState.period[1].toDate(),
          formState.workingHours / 5,
          formState.workingDays
        );
        if (result) {
          const carryoverHours = overtimeCarryover
            .filter((c) => c.userId === formState.userId && c.year === formState.period![0].year())
            .reduce((sum, c) => sum + c.overtimeHours, 0);
          const baseOvertimeHours = moment.duration(result.overtimeSeconds * 1000).asHours();
          formState.overtime = {
            businessHours: moment.duration(result.businessSeconds * 1000).asHours(),
            allocatedHours: moment.duration(result.allocatedSeconds * 1000).asHours(),
            overtimeHours: baseOvertimeHours,
            carryoverHours,
            totalOvertimeHours: baseOvertimeHours + carryoverHours,
            isOver: baseOvertimeHours + carryoverHours > 0,
            missingDates: result.missingDates.map((date) => moment(date).format('dd, DD.MM.YYYY'))
          };
        } else {
          formState.overtime = undefined;
        }
      }
    };

    const generateReport = async () => {
      if (formState.userId && formState.workspace && formState.period) {
        const result = await generatePDF(
          formState.apiKey,
          formState.userId,
          formState.workspace,
          formState.period[0].toDate(),
          formState.period[1].toDate()
        );
      }
    };

    const rules = {
      apiKey: [{ validator: validateApiKey, trigger: 'blur' }]
    };
    const ranges = {
      'This Month (so far)': [moment().startOf('month'), moment().subtract(1, 'day')],
      'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
      'This Year (so far)': [moment().startOf('year'), moment().subtract(1, 'day')],
      'Last Year': [moment().subtract(1, 'year').startOf('year'), moment().subtract(1, 'year').endOf('year')]
    };

    return {
      labelCol: { span: 4 },
      wrapperCol: { span: 14 },
      formRef,
      formState,
      rules,
      ranges,
      onSubmit,
      generateReport,
      changeUser
    };
  }
});
