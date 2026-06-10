const menuRepo = require('../repositories/menu.repository');

const MAX_DEPTH = 3;

async function getDepth(itemId) {
  let depth = 1;
  let current = await menuRepo.findById(itemId);
  while (current?.parent_id) {
    depth += 1;
    current = await menuRepo.findById(current.parent_id);
  }
  return depth;
}

async function isDescendant(ancestorId, nodeId) {
  let current = await menuRepo.findById(nodeId);
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    current = await menuRepo.findById(current.parent_id);
  }
  return false;
}

module.exports = { MAX_DEPTH, getDepth, isDescendant };
