import { TConfigurationParameters } from "./t-configuration-parameters";
import { ILoader } from "./loaders/i-loader";

export interface IConfigurationParameters<T> {
    homeDir?: string;
    confFileName: string;
    loaders?: Array<ILoader>;
    description: TConfigurationParameters<T>;
}
