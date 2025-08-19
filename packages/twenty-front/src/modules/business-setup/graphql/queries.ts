import { gql } from '@apollo/client';

export const GET_BUSINESS_SETUP_STATUS = gql`
  query GetBusinessSetupStatus {
    getBusinessSetupStatus
  }
`;
