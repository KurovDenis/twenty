import { gql } from '@apollo/client';

export const SET_BUSINESS_SETUP_STATUS = gql`
  mutation SetBusinessSetupStatus($status: BusinessSetupStatus!) {
    setBusinessSetupStatus(status: $status)
  }
`;
