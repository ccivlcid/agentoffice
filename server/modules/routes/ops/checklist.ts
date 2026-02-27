// @ts-nocheck
/**
 * CRUD for test checklists + AI generation
 * POST   /api/tasks/:id/checklist         — add item
 * GET    /api/tasks/:id/checklist         — list items
 * PATCH  /api/tasks/:id/checklist/:itemId — update item
 * DELETE /api/tasks/:id/checklist/:itemId — delete item
 * POST   /api/tasks/:id/checklist/generate — AI generate checklist
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import crypto from "node:crypto";

export function registerOpsChecklist(ctx: RuntimeContext): void {
  const { app, db } = ctx;

  // GET — list checklist items
  app.get("/api/tasks/:id/checklist", (req, res) => {
    const { id } = req.params;
    const rows = db
      .prepare(`SELECT * FROM test_checklists WHERE task_id = ? ORDER BY sort_order ASC, created_at ASC`)
      .all(id);
    res.json({ ok: true, items: rows });
  });

  // POST — add checklist item
  app.post("/api/tasks/:id/checklist", (req, res) => {
    const { id } = req.params;
    const { text, category, sort_order } = req.body ?? {};
    if (!text) return res.status(400).json({ error: "text_required" });

    const itemId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO test_checklists (id, task_id, text, category, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    ).run(itemId, id, text, category ?? null, sort_order ?? 0);

    const item = db.prepare("SELECT * FROM test_checklists WHERE id = ?").get(itemId);
    res.json({ ok: true, item });
  });

  // PATCH — update checklist item
  app.patch("/api/tasks/:id/checklist/:itemId", (req, res) => {
    const { itemId } = req.params;
    const updates = req.body ?? {};
    const fields: string[] = [];
    const values: unknown[] = [];

    if ("checked" in updates) {
      fields.push("checked = ?");
      values.push(updates.checked ? 1 : 0);
      if (updates.checked) {
        fields.push("checked_at = ?");
        values.push(Date.now());
      } else {
        fields.push("checked_at = NULL");
      }
    }
    if ("text" in updates) { fields.push("text = ?"); values.push(updates.text); }
    if ("note" in updates) { fields.push("note = ?"); values.push(updates.note); }
    if ("category" in updates) { fields.push("category = ?"); values.push(updates.category); }
    if ("sort_order" in updates) { fields.push("sort_order = ?"); values.push(updates.sort_order); }

    if (fields.length === 0) return res.status(400).json({ error: "no_fields" });

    values.push(itemId);
    db.prepare(`UPDATE test_checklists SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    const item = db.prepare("SELECT * FROM test_checklists WHERE id = ?").get(itemId);
    res.json({ ok: true, item });
  });

  // DELETE — remove checklist item
  app.delete("/api/tasks/:id/checklist/:itemId", (req, res) => {
    const { itemId } = req.params;
    db.prepare("DELETE FROM test_checklists WHERE id = ?").run(itemId);
    res.json({ ok: true });
  });

  // POST /generate — generate checklist from task context
  app.post("/api/tasks/:id/checklist/generate", (req, res) => {
    const { id } = req.params;
    const task = db
      .prepare("SELECT id, title, description, task_type FROM tasks WHERE id = ?")
      .get(id);
    if (!task) return res.status(404).json({ error: "task_not_found" });

    // Generate basic checklist items based on task type
    const items: Array<{ text: string; category: string }> = [];

    // Common items
    items.push(
      { text: "코드 변경사항이 의도한 대로 동작하는지 확인", category: "기능" },
      { text: "에러 없이 빌드되는지 확인", category: "빌드" },
      { text: "기존 기능이 정상 동작하는지 확인 (회귀 테스트)", category: "회귀" },
    );

    if (task.task_type === "development") {
      items.push(
        { text: "단위 테스트 통과 확인", category: "테스트" },
        { text: "타입 에러 없음 확인", category: "타입" },
        { text: "코드 스타일/린트 통과 확인", category: "품질" },
      );
    } else if (task.task_type === "design") {
      items.push(
        { text: "다크/라이트 모드 정상 표시 확인", category: "UI" },
        { text: "반응형 레이아웃 동작 확인", category: "UI" },
        { text: "접근성 기본 요건 확인", category: "접근성" },
      );
    } else if (task.task_type === "documentation") {
      items.push(
        { text: "문서 내용 정확성 검증", category: "내용" },
        { text: "링크 유효성 확인", category: "링크" },
      );
    }

    // Insert generated items
    const now = Date.now();
    for (let i = 0; i < items.length; i++) {
      const itemId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO test_checklists (id, task_id, text, category, auto_generated, sort_order, created_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      ).run(itemId, id, items[i].text, items[i].category, i, now);
    }

    const allItems = db
      .prepare(`SELECT * FROM test_checklists WHERE task_id = ? ORDER BY sort_order ASC`)
      .all(id);
    res.json({ ok: true, items: allItems });
  });
}
