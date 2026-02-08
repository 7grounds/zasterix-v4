/**
 * @MODULE_ID app.stage-1.asset-identification
 * @STAGE stage-1
 * @DATA_INPUTS ["AssetIdentificationModule"]
 * @REQUIRED_TOOLS ["ModuleShell"]
 */
import { AssetIdentificationModule } from "@/features/stage-1/asset-identification/AssetIdentificationModule";

const AssetIdentificationPage = () => {
  return <AssetIdentificationModule />;
};

export default AssetIdentificationPage;
