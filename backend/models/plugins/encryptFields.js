const { encrypt, decrypt } = require("../../utils/encryption");

/**
 * Mongoose plugin to encrypt specific fields.
 * @param {Schema} schema
 * @param {Object} options
 * @param {string[]} options.fields - Array of field paths to encrypt.
 */
module.exports = function (schema, options) {
  const fields = options.fields || [];

  schema.pre("save", function (next) {
    try {
      fields.forEach((field) => {
        if (this.isModified(field)) {
          const val = this.get(field);
          if (Array.isArray(val)) {
            const encrypted = val.map((v) =>
              typeof v === "string" ? encrypt(v) : v
            );
            this.set(field, encrypted);
          } else if (typeof val === "string") {
            this.set(field, encrypt(val));
          }
        }
      });
      next();
    } catch (error) {
      next(error);
    }
  });

  const decryptFields = (doc) => {
    try {
      fields.forEach((field) => {
        // Use get if available, otherwise try direct access (though init/save hooks usually provide doc)
        const val = doc.get ? doc.get(field) : undefined;

        if (val) {
          if (Array.isArray(val)) {
            const decrypted = val.map((v) =>
              typeof v === "string" ? decrypt(v) : v
            );
            doc.set(field, decrypted);
          } else if (typeof val === "string") {
            doc.set(field, decrypt(val));
          }
        }
      });
    } catch (error) {
      console.error("Error decrypting fields:", error);
    }
  };

  schema.post("init", decryptFields);
  schema.post("save", decryptFields);
};
