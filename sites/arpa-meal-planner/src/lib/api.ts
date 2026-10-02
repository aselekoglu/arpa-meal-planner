export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, { ...options, credentials: 'same-origin' });
  if (response.status === 401) {
    window.location.assign('/signin-with-chatgpt?return_to=' + encodeURIComponent(window.location.pathname + window.location.search));
  }
  return response;
};
