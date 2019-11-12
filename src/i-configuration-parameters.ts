import { TConfigurationParameters } from "./t-configuration-parameters";
import { ILoader } from "./loaders/i-loader";
import { ISaver } from "./savers/i-saver";

export interface IConfigurationParameters<T> {
    homeDir?: string;
    confFileName: string;
    loaders?: Array<ILoader>;
    saveConf?: ISaver;
    description: TConfigurationParameters<T>;
    helpsParams?: {longNames: string[], shortNames: string[] };
    helpFinally?: (help: string) => Promise<void>;
    savesParams?: {longNames: string[], shortNames: string[] };
}
