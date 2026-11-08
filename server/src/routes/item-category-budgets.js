import { Router } from "express";

import { listCategoryBudgets } from "../budget.js";

export const itemCategoryBudgetsRouter = Router();

// Kategorija stavki s limitom potrosnje unutar jedne fiskalne godine, uz iznos
// koji je vec obecan odobrenim zahtjevima.
itemCategoryBudgetsRouter.get("/", async (req, res) => {
  res.json(await listCategoryBudgets({ year: req.query.fiscalYear ?? null }));
});
