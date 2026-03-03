"use client";

import type { User } from "@/shared/types/domain";

type Props = {
  users: User[];
};

export function UsersList({ users }: Props) {
  return (
    <section className="card">
      <h2>Users</h2>
      <ul className="list">
        {users.map((user) => (
          <li key={user.id}>
            <strong>{user.full_name}</strong>
            <div>{user.email}</div>
            <small>id: {user.id}</small>
          </li>
        ))}
      </ul>
      {!users.length && <p>No users found.</p>}
    </section>
  );
}
