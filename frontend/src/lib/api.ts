import axios from 'axios'

export const api = axios.create({
  baseURL: '/monitor_platform/api',
  withCredentials: true,
})

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/monitor_platform/login')) {
      window.location.href = '/monitor_platform/login'
    }
    return Promise.reject(error)
  },
)
