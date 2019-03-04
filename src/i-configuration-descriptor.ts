export interface IConfigurationDescriptor<T, U> {
    name: T;
    fromConf?: string;
    fromParam?: string;
    fromEnv?: string;
    type: 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'boolean[]' | 'json';
    isMandatory?: boolean;
    default?: U;
    isNullable?: boolean;
    isUndefinedable?: boolean;
    onBadValue?: <V>(value: any, index?: number) => Promise<U> | Promise<V> | U | V;
    onValue?: <V>(value: V, index?: number) => Promise<V> | V;
}