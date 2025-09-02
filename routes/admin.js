// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const admin = require("../firebaseAdmin"); // Adjust path as needed

// Get all Firebase users
// Get all Firebase users (only verified email users or phone users)
router.get("/users", async (req, res) => {
  try {
    const listAllUsers = async (nextPageToken, users = []) => {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      users.push(...result.users);

      if (result.pageToken) {
        return await listAllUsers(result.pageToken, users);
      }
      return users;
    };

    const allUsers = await listAllUsers();

    // ✅ Filter out users with unverified email
    const filtered = allUsers.filter(user => {
      // Keep if:
      // 1. Email exists and is verified, OR
      // 2. User has a phone number
      return (user.email && user.emailVerified) || user.phoneNumber;
    });

    res.json(
      filtered.map((user) => ({
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        phone: user.phoneNumber,
        provider: user.providerData.map((p) => p.providerId).join(", "),
      }))
    );
  } catch (err) {
    console.error("Error listing Firebase users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ✅ Delete a Firebase user by UID
router.delete("/users/:uid", async (req, res) => {
  try {
    await admin.auth().deleteUser(req.params.uid);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

module.exports = router;
