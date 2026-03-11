export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const familyId = localStorage.getItem('familyId') || 'default';
  
  const headers = {
    ...options.headers,
    'x-family-id': familyId,
  };

  return fetch(url, { ...options, headers });
};
