import { CustomerRepository } from "@/repositories/postgres/customer.repository";

export async function getAllCustomers() {
  return CustomerRepository.getAll();
}

export async function getCustomerCount() {
  return CustomerRepository.count();
}
