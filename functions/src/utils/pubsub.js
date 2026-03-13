"use strict";

const { PubSub } = require("@google-cloud/pubsub");
const { log, error: logError } = require("./logger");

const pubsub = new PubSub();

/**
 * Publishes a message to a Pub/Sub topic safely.
 * @param {string} topicName - The name of the topic.
 * @param {object} data - The JSON payload.
 * @returns {Promise<string|null>} The message ID or null if failed.
 */
async function publishMessage(topicName, data) {
    try {
        const dataBuffer = Buffer.from(JSON.stringify(data));
        const messageId = await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
        log(`PubSub: Mensaje publicado en ${topicName}`, { messageId });
        return messageId;
    } catch (error) {
        logError(`PubSub Error: Fallo al publicar en ${topicName}`, error);
        return null;
    }
}

module.exports = { publishMessage };
