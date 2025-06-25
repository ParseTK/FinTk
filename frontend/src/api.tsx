import axios from 'axios';
import { CompanySearch } from './company';

export interface SearchResponse {
  data: CompanySearch[];
}
export const searchCompanies = async (query: string) => {
  try {
    const response = await axios.get<SearchResponse>(
      `https://financialmodelingprep.com/api/v3/search?query=${query}&apikey=${process.env.REACT_APP_API_KEY}`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Error fetching company data:", error.message);
      return error.message;
    } else {
      console.error("Unexpected error:", error);
      return "An unexpected error occurred";
    }
  }
};