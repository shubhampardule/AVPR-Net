// Static scanner contract fixture. Never imported or executed.
function unsafe(req, db) {
  db.query("SELECT * FROM accounts WHERE id=" + req.query.id);
  return eval(req.query.expression);
}
