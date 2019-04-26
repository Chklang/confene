export interface IConfigurationDescriptor<T, U> {
    name: T;
    from?: {[key: string]: string[]};
    type: 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'boolean[]' | 'json';
    isMandatory?: boolean;
    default?: U;
    isNullable?: boolean;
    onBadValue?: <V>(value: any, index?: number) => Promise<U> | Promise<V> | U | V;
    onValue?: <V>(value: V, index?: number) => Promise<V> | V;
}