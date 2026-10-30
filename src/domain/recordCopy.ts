export const cloneRecord = <T>(value:T):T => JSON.parse(JSON.stringify(value))
