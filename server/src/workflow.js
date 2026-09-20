// Provjera je li promjena statusa dopustena. Pravila su podaci u tablici
// StatusTransition, ovdje se samo primjenjuju.

export class WorkflowError extends Error {
  constructor(message, status = 422) {
    super(message)
    this.status = status
  }
}

const transitionSql = `
  select st.id_status_transition, st.requires_comment, st.fk_role,
         ts.id_purchase_request_status as to_status_id, ts.code as to_status_code,
         ts.name as to_status_name,
         rd.id_document_type as required_document_type_id, rd.name as required_document_type_name,
         gd.id_document_type as generated_document_type_id, gd.code as generated_document_type_code,
         r.code as allowed_role_code
    from StatusTransition st
    join PurchaseRequestStatus ts on ts.id_purchase_request_status = st.fk_to_status
    left join DocumentType rd on rd.id_document_type = st.fk_required_document_type
    left join DocumentType gd on gd.id_document_type = st.fk_generates_document_type
    left join Role r on r.id_role = st.fk_role
   where st.fk_from_status = ?
     and st.applies_to_source in ('ANY', ?)
     and ts.code = ?`

/**
 * Vraca pravilo prijelaza ako je dopusten, inace baca WorkflowError s porukom
 * koja kaze sto tocno nedostaje.
 */
export async function assertTransitionAllowed(db, { request, toStatusCode, user, comment }) {
  const rule = await db.queryOne(transitionSql, [
    request.fk_purchase_request_status,
    request.source,
    toStatusCode,
  ])

  if (rule === null) {
    throw new WorkflowError(
      `Iz statusa "${request.status_name}" nije moguce prijeci u "${toStatusCode}"`,
    )
  }

  // administrator smije sve
  if (user.role_code !== 'ADMIN' && rule.allowed_role_code !== null) {
    if (rule.allowed_role_code !== user.role_code) {
      throw new WorkflowError('Nemate ovlasti za ovaj korak', 403)
    }
  }

  if (rule.requires_comment === 1 && !comment?.trim()) {
    throw new WorkflowError('Ovaj korak trazi komentar')
  }

  if (rule.required_document_type_id !== null) {
    const attachment = await db.queryOne(
      `select id_purchase_request_attachment
         from PurchaseRequestAttachment
        where fk_purchase_request = ? and fk_document_type = ? and is_current = 1
        limit 1`,
      [request.id_purchase_request, rule.required_document_type_id],
    )

    if (attachment === null) {
      throw new WorkflowError(`Za ovaj korak potrebno je priloziti dokument: ${rule.required_document_type_name}`)
    }
  }

  return rule
}

/** Sljedeci broj zahtjeva u fiskalnoj godini, npr. ZN-2026-0001. */
export async function nextRequestNumber(db, { fiscalYearId, year }) {
  const row = await db.queryOne(
    `select max(cast(substring_index(request_number, '-', -1) as unsigned)) as last_number
       from PurchaseRequest
      where fk_fiscal_year = ?
      for update`,
    [fiscalYearId],
  )

  const next = (row?.last_number ?? 0) + 1

  return `ZN-${year}-${String(next).padStart(4, '0')}`
}
