module.exports = async function (context, req) {
    context.res = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: {
            message: "Engage! 🖖 The API is live.",
            timestamp: new Date().toISOString()
        }
    };
};
