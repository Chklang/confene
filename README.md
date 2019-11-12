# Confene

# Why this package
Goal of Confene is to give an easy way to create a configuration for yours nodes projects. You can give easily configuration by:
* Environement variable
* Configration file
* Arguments

# How to use it
1. Create an interface of your configuration
```typepscript
export interface IMyConf {
    key1: string;
    key2: number;
    key3: boolean[];
    key4: IMyObject;
}
```
2. Create a factory for this configuration
```typescript
export class MyConfFactory implements IConfigurationFactory<IMyConf> {
    public instance: Promise<IMyConf>;
    public description: IConfigurationParameters<IMyConf> = {
        confFileName: ".myproject.conf.json";
        description: {
            key1: {
                name: "key1",
                type: "string",
                description: "Key 1 for example"
            },
            key2: {
                name: "key2",
                type: "number"
            },
            key3: {
                name: "key3",
                type: "boolean[]"
            },
            key4: {
                name: "key4",
                type: "json"
            }
        };
    }
}
```

3. Use it
```typescript
ConfigurationFactory.get(new MyConfFactory()).then((conf) => {
    //Read conf
    conf.key1...
})
```

# Ho does it works
When you call ConfigurationFactory.get(), Confene will try to get your conf from
1. Arguments
2. Environment variables
3. Configuration file from home dir

# Options
```typescript
export interface IConfigurationParameters<T> {
    homeDir?: string; //Specify homedir. Default is os.homedir()
    confFileName: string; //Name of configuration file
    loaders?: Array<ILoader>; //Loaders to read conf. Default is [new ArgsLoader(), new EnvLoader(), new ConfLoader()]
    saverConf?: ISaver; //Class to use to save configuration
    description: TConfigurationParameters<T>; //Description of your configuration object
    helpsParams?: {longNames: string[], shortNames: string[] }; //Parameters to show help. By default : --help, -h
    savesParams?: {longNames: string[], shortNames: string[] }; //Parameters to save conf. By default : --save
    helpFinally?: (help: string) => Promise<void>; //Callback when help is shown. By default : console.log(help) && process.exit(0);
}
```

```typescript
export interface IConfigurationDescriptor<T, U> {
    name: T; //Property name
    from?: {
        [key: string]: string[] // Loader name with names into this loader. With it, you can (for example) choose differents keys for conf from arguments and from file
        // By default keys are: "conf", "env", "args"
    };
    type: 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'boolean[]' | 'json'; //Type of property
    isMandatory?: boolean; //Specify is Confene must throw an error is value isn't specified
    default?: U; //Default value
    isNullable?: boolean; //Value can be null
    isUndefinedable?: boolean; //Value can be undefined
    shortAlias?: string[]; // Short alias of this property
    longAlias?: string[]; // Long alias of this property
    description?: string; // Description of this field. Used for help generation
    onBadValue?: <V>(value: any, index?: number) => Promise<U> | Promise<V> | U | V; //Callback on a bad value
    onValue?: <V>(value: V, index?: number) => Promise<V> | V; //Callback on a good value
}
```