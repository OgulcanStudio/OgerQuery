export interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  age: number;
}

export const users: User[] = [
  { id: 1, name: 'Josh', email: 'josh@example.com', active: true, age: 30 },
  { id: 2, name: 'Amy', email: 'amy@example.com', active: false, age: 25 },
  { id: 3, name: 'Josh', email: 'josh2@example.com', active: true, age: 35 },
];

export function* genUsers(): Generator<User> {
  yield* users;
}

export async function* asyncUsers(): AsyncGenerator<User> {
  for (const u of users) {
    yield u;
  }
}

export function setFrom<T>(items: T[]): Set<T> {
  return new Set(items);
}
