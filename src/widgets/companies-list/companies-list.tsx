"use client";

import type { Company } from "@/shared/types/domain";

type Props = {
  companies: Company[];
};

export function CompaniesList({ companies }: Props) {
  return (
    <section className="card">
      <h2>Companies</h2>
      <ul className="list">
        {companies.map((company) => (
          <li key={company.id}>
            <strong>{company.name}</strong>
            <div>created_by: {company.created_by}</div>
            <small>id: {company.id}</small>
          </li>
        ))}
      </ul>
      {!companies.length && <p>No companies found.</p>}
    </section>
  );
}
