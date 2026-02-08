/**
 * @MODULE_ID app.stage-2.fee-monster
 * @STAGE stage-2
 * @DATA_INPUTS ["FeeMonsterModule"]
 * @REQUIRED_TOOLS ["ModuleShell"]
 */
import { FeeMonsterModule } from "@/features/stage-2/fee-monster";

export const dynamic = 'force-dynamic';

const FeeMonsterPage = () => {
  return <FeeMonsterModule />;
};

export default FeeMonsterPage;
