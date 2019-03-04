import { IConfigurationParameters } from ".";

export interface IConfigurationFactory<T> {
    instance: Promise<T>;
    description: IConfigurationParameters<T>;
}