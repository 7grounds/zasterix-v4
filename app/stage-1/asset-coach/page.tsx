/**
 * @MODULE_ID app.stage-1.asset-coach
 * @STAGE stage-1
 * @DATA_INPUTS ["AssetCoachModule"]
 * @REQUIRED_TOOLS ["TaskRenderer"]
 */
import { AssetCoachModule } from "@/features/stage-1/asset-coach/AssetCoachModule";

const AssetCoachPage = () => {
  return <AssetCoachModule />;
};

export default AssetCoachPage;
