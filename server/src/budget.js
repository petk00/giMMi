// Potrosnja po kategorijama proracuna i pokrice zahtjeva.
//
// Novac je obecan kad je zahtjev odobren, pa se od tog statusa nadalje broji u
// potroseno. Iznos stavke racuna se s PDV-om, jer ga ustanova ne odbija i
// placa ga iz istog proracuna.

import { query } from "./db.js";

export const COMMITTED_STATUSES = ["APPROVED", "ORDERED", "RECEIVED", "CLOSED"];

// do ovog udjela potrosnje kategorija je jos "u redu", iznad se upozorava
const WARN_SHARE = 0.9;

export const itemGrossSql =
  "pri.quantity * pri.unit_price * (1 + pri.vat_rate / 100)";

const committedList = COMMITTED_STATUSES.map((code) => `'${code}'`).join(", ");

/** Kategorije s limitom i iznosom koji je vec obecan odobrenim zahtjevima. */
export function listCategoryBudgets({ year = null, fiscalYearId = null } = {}) {
  return query(
    `select cat.id_item_category_budget, cat.name, cat.budget_limit, cat.is_active,
            cat.fk_fiscal_year, fy.year,
            coalesce(sum(case when st.code in (${committedList}) then ${itemGrossSql} end), 0)
              as committed_amount
       from ItemCategoryBudget cat
       join FiscalYear fy on fy.id_fiscal_year = cat.fk_fiscal_year
       left join PurchaseRequestItem pri on pri.fk_item_category_budget = cat.id_item_category_budget
       left join PurchaseRequest pr on pr.id_purchase_request = pri.fk_purchase_request
       left join PurchaseRequestStatus st
         on st.id_purchase_request_status = pr.fk_purchase_request_status
      where (? is null or fy.year = ?)
        and (? is null or fy.id_fiscal_year = ?)
      group by cat.id_item_category_budget, cat.name, cat.budget_limit, cat.is_active,
               cat.fk_fiscal_year, fy.year
      order by cat.name`,
    [year, year, fiscalYearId, fiscalYearId],
  );
}

const percentFormat = new Intl.NumberFormat("hr-HR", {
  maximumFractionDigits: 0,
});

/**
 * Pokrice za svaki zahtjev s popisa: ima li svaka stavka kategoriju i staje li
 * zahtjev u ono sto kategoriji ostaje. Vlastiti iznos odobrenog zahtjeva je vec
 * u potrosenom, pa se za njega oduzima da se ne broji dvaput.
 *
 * Vraca Map id_zahtjeva -> { state, label }, state je ok | warn | missing.
 */
export async function coverageFor(requests) {
  const coverage = new Map();

  if (requests.length === 0) {
    return coverage;
  }

  const placeholders = requests.map(() => "?").join(", ");
  const items = await query(
    `select pri.fk_purchase_request, pri.fk_item_category_budget, ${itemGrossSql} as amount
       from PurchaseRequestItem pri
      where pri.fk_purchase_request in (${placeholders})`,
    requests.map((request) => request.id_purchase_request),
  );

  const categories = new Map(
    (await listCategoryBudgets()).map((cat) => [
      cat.id_item_category_budget,
      cat,
    ]),
  );

  for (const request of requests) {
    const own = items.filter(
      (item) => item.fk_purchase_request === request.id_purchase_request,
    );

    if (own.length === 0) {
      coverage.set(request.id_purchase_request, {
        state: "missing",
        label: "nema stavki",
      });
      continue;
    }

    const withoutCategory = own.filter(
      (item) => item.fk_item_category_budget === null,
    ).length;

    if (withoutCategory > 0) {
      coverage.set(request.id_purchase_request, {
        state: "missing",
        label:
          withoutCategory === own.length
            ? "nema kategorije"
            : `${withoutCategory} od ${own.length} stavki bez kategorije`,
      });
      continue;
    }

    // zbroj zahtjeva po kategoriji
    const needed = new Map();

    for (const item of own) {
      needed.set(
        item.fk_item_category_budget,
        (needed.get(item.fk_item_category_budget) ?? 0) + Number(item.amount),
      );
    }

    const isCommitted = COMMITTED_STATUSES.includes(request.status_code);
    let worst = { state: "ok", label: "pokriveno", share: 0 };

    for (const [categoryId, amount] of needed) {
      const cat = categories.get(categoryId);
      const limit = Number(cat.budget_limit);
      const others = Number(cat.committed_amount) - (isCommitted ? amount : 0);
      const share = limit > 0 ? (others + amount) / limit : Infinity;

      if (share > 1 && share > worst.share) {
        worst = { state: "warn", label: `${cat.name}: nema dovoljno`, share };
      } else if (
        share > WARN_SHARE &&
        worst.share <= 1 &&
        share > worst.share
      ) {
        worst = {
          state: "warn",
          label: `${cat.name} na ${percentFormat.format(share * 100)} %`,
          share,
        };
      }
    }

    coverage.set(request.id_purchase_request, {
      state: worst.state,
      label: worst.label,
    });
  }

  return coverage;
}
