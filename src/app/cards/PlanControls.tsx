import type { Inputs } from '../../domain/types';
import { FreeTimePicker } from '../components/FreeTimePicker';
import { SegmentedControl } from '../components/SegmentedControl';
import { ACTIVITY_OPTIONS, DURATION_OPTIONS } from '../ui';

interface Props {
  inputs: Inputs;
  onFreeTime(v: Inputs['freeTime']): void;
  onDuration(v: Inputs['duration']): void;
  onActivity(v: Inputs['activity']): void;
}

const HEADING = 'm-0 text-[15px] font-semibold leading-5 text-text';

/** The plan inputs: free time window, duration and activity. Lives in the Plan sheet or card. */
export function PlanControls({ inputs, onFreeTime, onDuration, onActivity }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className={HEADING}>Free time</h3>
        <FreeTimePicker value={inputs.freeTime} onChange={onFreeTime} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className={HEADING}>Duration</h3>
        <SegmentedControl
          label="Duration"
          options={DURATION_OPTIONS}
          value={inputs.duration}
          onChange={onDuration}
        />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className={HEADING}>Activity</h3>
        <SegmentedControl
          label="Activity"
          options={ACTIVITY_OPTIONS}
          value={inputs.activity}
          onChange={onActivity}
        />
      </div>
    </div>
  );
}
