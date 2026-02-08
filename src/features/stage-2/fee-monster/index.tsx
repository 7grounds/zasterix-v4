/**
 * @MODULE_ID stage-2.fee-monster.module
 * @STAGE stage-2
 * @DATA_INPUTS ["feeMonsterTasks"]
 * @REQUIRED_TOOLS ["ModuleShell", "FeeCalculator"]
 */
"use client";

import { ModuleShell } from "@/shared/components/ModuleShell";
import { FeeCalculator } from "@/shared/tools/FeeCalculator";
import { feeMonsterTasks } from "./tasks.config";

export const FeeMonsterModule = () => {
  return (
    <ModuleShell
      moduleId="fee-monster"
      stageId="stage-2"
      title="The Fee-Monster"
      subtitle="Expose fee drag and engineer smarter order sizing before execution."
      tasks={feeMonsterTasks}
      toolRenderers={{
        "fee-calculator": () => <FeeCalculator />,
      }}
    />
  );
};
