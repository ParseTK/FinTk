import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import { SearchPage } from '../Pages/SearchPage/SearchPage';
import { CompanyPage } from '../Pages/CompanyPage/CompanyPage';
import { HomePage } from '../Pages/HomePage/HomePage';

export const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            { path: "", element: <HomePage /> },
            { path: "Search", element: <SearchPage /> },
            { path: "company/:ticker", element: <CompanyPage /> },
           
        ]
    }
]);