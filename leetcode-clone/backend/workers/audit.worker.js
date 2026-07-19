const { Worker } = require("bullmq");
const { connection } = require("../queues/auditQueue");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const auditWorker = new Worker(
    "audit-queue",
    async (job) => {
        const { userId, event, metadata } = job.data;
        
        console.log(`[AuditWorker] Processing event '${event}' for user ${userId}`);
        
        // Serialize metadata into action string if it's complex, since schema only has 'action' text field
        const actionPayload = JSON.stringify({ event, metadata });

        const { error } = await supabase.from("audit_logs").insert([
            {
                performed_by: userId,
                action: actionPayload
            }
        ]);

        if (error) {
            console.error("[AuditWorker] Error inserting audit log:", error);
            throw error;
        }
        
        return { success: true };
    },
    {
        connection,
        concurrency: 5 
    }
);

auditWorker.on("completed", (job) => {
    console.log(`[AuditWorker] Job ${job.id} completed successfully`);
});

auditWorker.on("failed", (job, err) => {
    console.error(`[AuditWorker] Job ${job.id} failed:`, err.message);
});

console.log("Audit Worker started and listening for jobs...");

module.exports = auditWorker;
