const jwt = require('jsonwebtoken');

const JWT_SECRET = "dev_secret_key_12345";
const payload = { id: 1, role: "admin", email: "admin@supercontable.com" };
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

console.log("\n========================================================");
console.log("🎯 COMANDO PARA TU TAREA (CÓPIALO COMPLETO):");
console.log("========================================================\n");
console.log(`curl -X PUT http://localhost:3000/api/admin/contables/2/plan \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token}" \\
  -d '{"plan": "STARTER"}'`);
console.log("\n========================================================\n");
