import axios from 'axios';

const baseURL = process.env.LOCAL_DB_URL || 'http://localhost:8000';

export const LocalDBClient = {
  async getUserBySlackId(slackId: string) {
    try {
      const res = await axios.get(`${baseURL}/users/slack/${slackId}`);
      return { data: res.data.user, error: null };
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        return { data: null, error: null };
      }
      return { data: null, error: { message: err.message } };
    }
  },

  async createUser(payload: any) {
    try {
      const res = await axios.post(`${baseURL}/users`, payload);
      return { data: res.data.user, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  },

  async getUserById(id: number) {
    try {
      const res = await axios.get(`${baseURL}/users/${id}`);
      return { data: res.data.user, error: null };
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        return { data: null, error: null };
      }
      return { data: null, error: { message: err.message } };
    }
  },

  async updateUser(id: number, payload: any) {
    try {
      await axios.put(`${baseURL}/users/${id}`, payload);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err.message } };
    }
  },

  async submissionsCount(authorId: number) {
    try {
      const res = await axios.get(`${baseURL}/submissions/count`, { params: { author_id: authorId } });
      return { count: res.data.count, error: null };
    } catch (err: any) {
      return { count: 0, error: { message: err.message } };
    }
  }
};
