import React, { useEffect, useState } from 'react'
import { getCompanyProfile } from '../../api';
import { CompanyProfile } from '../../company';
import { useParams } from 'react-router-dom';

interface Props {}

export const CompanyPage = (props: Props) => {
  let { ticker } = useParams();
  const [getCompany, setCompany] = useState<CompanyProfile>();
  
  useEffect(() => {
    const fetchCompanyProfile = async () => {
      const result = await getCompanyProfile(ticker!);
      setCompany(result?.data[0]);
    }
    fetchCompanyProfile();
  }, []);

    return ( 
    <> 
    {getCompany ? (
      <div>{getCompany.companyName}</div>
    ) : (
      <div>Company not found</div>
    )}
    </>
  );
};
