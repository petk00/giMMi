import { Router } from 'express'

import { requireAuth } from '../auth.js'

import { healthRouter } from './health.js'
import { authRouter } from './auth.js'
import { fiscalYearsRouter } from './fiscal-years.js'
import { departmentsRouter } from './departments.js'
import { departmentBudgetsRouter } from './department-budgets.js'
import { itemCategoryBudgetsRouter } from './item-category-budgets.js'
import { purchaseRequestStatusesRouter } from './purchase-request-statuses.js'
import { documentTypesRouter } from './document-types.js'
import { usersRouter } from './users.js'
import { purchaseRequestsRouter } from './purchase-requests.js'
import { offersRouter } from './offers.js'

export const apiRouter = Router()

// javno: provjera stanja i prijava
apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)

// sve ostalo trazi prijavu
apiRouter.use(requireAuth)
apiRouter.use('/fiscal-years', fiscalYearsRouter)
apiRouter.use('/departments', departmentsRouter)
apiRouter.use('/department-budgets', departmentBudgetsRouter)
apiRouter.use('/item-category-budgets', itemCategoryBudgetsRouter)
apiRouter.use('/purchase-request-statuses', purchaseRequestStatusesRouter)
apiRouter.use('/document-types', documentTypesRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/purchase-requests', purchaseRequestsRouter)
apiRouter.use('/offers', offersRouter)
