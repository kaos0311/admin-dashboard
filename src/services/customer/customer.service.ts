import { CustomerRepository } from "@/repositories/postgres/customer.repository";

export async function getCustomerCount() {
  return CustomerRepository.count();
}
