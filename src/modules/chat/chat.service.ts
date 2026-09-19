import { pool } from "../../config/db";

export class ChatService {
  async getConversations(userId: string) {
    const query = `
      SELECT c.*,
             CASE WHEN c.borrower_id = $1 THEN o.name ELSE b.name END as other_user_name,
             CASE WHEN c.borrower_id = $1 THEN 'OWNER' ELSE 'BORROWER' END as other_user_role,
             (SELECT message FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time,
             (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id AND m.status != 'READ' AND m.sender_id != $1) as unread_count
      FROM conversations c
      JOIN users b ON c.borrower_id = b.id
      JOIN users o ON c.owner_id = o.id
      WHERE c.borrower_id = $1 OR c.owner_id = $1
      ORDER BY last_message_time DESC NULLS LAST, c.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async getConversation(borrowerId: string, ownerId: string) {
    let query = `SELECT * FROM conversations WHERE borrower_id = $1 AND owner_id = $2`;
    let result = await pool.query(query, [borrowerId, ownerId]);
    if (result.rows.length === 0) {
      query = `INSERT INTO conversations (borrower_id, owner_id) VALUES ($1, $2) RETURNING *`;
      result = await pool.query(query, [borrowerId, ownerId]);
    }
    return result.rows[0];
  }

  async getMessages(conversationId: string, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT * FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [conversationId, limit, offset]);
    return result.rows.reverse(); // Return in chronological order
  }

  async saveMessage(conversationId: string, senderId: string, message: string) {
    const query = `
      INSERT INTO messages (conversation_id, sender_id, message)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [conversationId, senderId, message]);
    return result.rows[0];
  }

  async markAsRead(conversationId: string, userId: string) {
    const query = `
      UPDATE messages
      SET status = 'READ'
      WHERE conversation_id = $1 AND sender_id != $2 AND status != 'READ'
    `;
    await pool.query(query, [conversationId, userId]);
  }
}
