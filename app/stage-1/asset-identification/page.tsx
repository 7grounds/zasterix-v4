/**
 * @MODULE_ID app.stage-1.asset-identification
 * @STAGE stage-1
 * @DATA_INPUTS ["AssetIdentificationModule"]
 * @REQUIRED_TOOLS ["ModuleShell"]
 */
import { AssetIdentificationModule } from "@/features/stage-1/asset-identification/AssetIdentificationModule";

export const dynamic = 'force-dynamic';

const AssetIdentificationPage = () => {
  return <AssetIdentificationModule />;
};

export default AssetIdentificationPage;
