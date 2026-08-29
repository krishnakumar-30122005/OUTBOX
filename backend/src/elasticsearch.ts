import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
let esClient: Client;

try {
  esClient = new Client({
    node: esNode,
  });
} catch (error) {
  console.error('Error creating Elasticsearch client:', error);
}

/**
 * Initializes indices and mappings in Elasticsearch
 */
export async function initElasticsearch() {
  try {
    const exists = await esClient.indices.exists({ index: 'emails' });
    if (!exists) {
      await esClient.indices.create({
        index: 'emails',
        mappings: {
          properties: {
            id: { type: 'keyword' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            senderEmail: { type: 'keyword' },
            senderName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            userId: { type: 'keyword' },
          },
        },
      });
      console.log('Elasticsearch index "emails" created.');
    } else {
      console.log('Elasticsearch index "emails" already exists.');
    }
  } catch (error) {
    console.error('Failed to initialize Elasticsearch index:', error);
  }
}

/**
 * Indexes or updates an email record in Elasticsearch
 */
export async function indexEmail(email: any, sender: any) {
  try {
    await esClient.index({
      index: 'emails',
      id: email.id,
      document: {
        id: email.id,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt instanceof Date ? email.scheduledAt.toISOString() : new Date(email.scheduledAt).toISOString(),
        sentAt: email.sentAt ? (email.sentAt instanceof Date ? email.sentAt.toISOString() : new Date(email.sentAt).toISOString()) : null,
        senderEmail: sender.email,
        senderName: sender.name,
        userId: email.userId,
      },
    });
  } catch (error) {
    console.error(`Error indexing email ${email.id} to ES:`, error);
  }
}

/**
 * Deletes an email from the Elasticsearch index
 */
export async function deleteEmailFromIndex(emailId: string) {
  try {
    await esClient.delete({
      index: 'emails',
      id: emailId,
    });
  } catch (error: any) {
    if (error.meta?.statusCode !== 404) {
      console.error(`Error deleting email ${emailId} from ES:`, error);
    }
  }
}

/**
 * Performs full-text search on indexed emails
 */
export async function searchEmailsInIndex(userId: string, query: string, status?: string) {
  try {
    const mustQueries: any[] = [
      { term: { userId } },
    ];

    if (status) {
      mustQueries.push({ term: { status } });
    }

    if (query && query.trim() !== '') {
      mustQueries.push({
        multi_match: {
          query,
          fields: ['subject', 'body', 'recipient', 'senderName', 'senderEmail'],
          fuzziness: 'AUTO',
        },
      });
    }

    const response = await esClient.search({
      index: 'emails',
      query: {
        bool: {
          must: mustQueries,
        },
      },
      sort: [
        { scheduledAt: { order: 'desc' } },
      ],
      size: 100,
    });

    return response.hits.hits.map((hit: any) => hit._source);
  } catch (error) {
    console.error('Error searching emails in Elasticsearch:', error);
    return [];
  }
}

export default esClient!;
