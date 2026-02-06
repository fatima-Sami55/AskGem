class StorageService {
    constructor() {
        this.profiles = {};
    }

    saveProfile(id, data) {
        this.profiles[id] = { ...this.profiles[id], ...data, lastUpdated: new Date() };
        return this.profiles[id];
    }

    getProfile(id) {
        return this.profiles[id];
    }

    getAllProfiles() {
        return this.profiles;
    }
}

module.exports = new StorageService();
