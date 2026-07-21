const users = [
    {
        id: 1,
        email: "teacher@test.com",
        password: "$2b$10$fD/NMKGz/zrHJqZSq/eJxus4WrZM2tPXMIJTX9OjA/Vofz4sbY3kS", // password: "password"
        role: "teacher",
        provider: "local",
        isVerified: true
    },
    {
        id: 2,
        email: "student@test.com",
        password: "$2b$10$fD/NMKGz/zrHJqZSq/eJxus4WrZM2tPXMIJTX9OjA/Vofz4sbY3kS", // password: "password"
        role: "student",
        provider: "local",
        isVerified: true
    },
    {
        id: 3,
        email: "admin@test.com",
        password: "$2b$10$fD/NMKGz/zrHJqZSq/eJxus4WrZM2tPXMIJTX9OjA/Vofz4sbY3kS", // password: "password"
        role: "admin",
        provider: "local",
        isVerified: true
    },
    {
        id: 4,
        email: "master@test.com",
        password: "$2b$10$fD/NMKGz/zrHJqZSq/eJxus4WrZM2tPXMIJTX9OjA/Vofz4sbY3kS", // password: "password"
        role: "master_admin",
        provider: "local",
        isVerified: true
    }
];

// Mock DB wrapper
module.exports = {
    findAll: () => users,
    find: (predicate) => users.find(predicate),
    findOne: async (predicate) => users.find(predicate ? (typeof predicate === 'function' ? predicate : u => Object.keys(predicate).every(k => u[k] === predicate[k])) : null),
    push: (user) => users.push(user),
    map: (cb) => users.map(cb),
    length: users.length,
    updateOne: async (query, update) => {
        const user = users.find(u => Object.keys(query).every(k => u[k] === query[k]));
        if (user) {
            Object.assign(user, update);
            return { n: 1 };
        }
        return { n: 0 };
    }
};

