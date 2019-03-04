import { IConfigurationDescriptor } from "./i-configuration-descriptor";

export type TConfigurationParameters<T> = {
    [P in keyof T]: IConfigurationDescriptor<P, T[P]>;
}
