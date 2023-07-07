type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
type UnwrapArray<T> = T extends Array<infer U> ? U : T;
