import { WorkOrderRepository } from "@/repositories/postgres/work-order.repository";

export async function getAllWorkOrders() {
  return WorkOrderRepository.getAll();
}

export async function getWorkOrderCount() {
  return WorkOrderRepository.count();
}
