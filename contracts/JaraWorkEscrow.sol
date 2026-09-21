// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract JaraWorkEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OrderStatus {
        Open,
        Claimed,
        Delivered,
        Completed,
        Refunded,
        Disputed
    }

    struct Order {
        string orderId;
        string title;
        string description;
        string sourceMarketplace;
        uint256 amount;
        address buyer;
        address worker;
        OrderStatus status;
        uint256 createdAt;
        uint256 claimedAt;
        uint256 completedAt;
        string deliveryProof;
    }

    IERC20 public immutable usdc;
    uint256 public feeBasisPoints;
    address public platformFeeRecipient;
    address public platform;
    uint256 public claimTimeout = 7 * 24 * 3600;

    mapping(bytes32 => Order) private orders;
    mapping(bytes32 => bool) private orderExists;
    bytes32[] private orderKeys;

    event OrderCreated(
        bytes32 indexed key,
        string orderId,
        address indexed buyer,
        uint256 amount,
        string sourceMarketplace
    );
    event OrderClaimed(bytes32 indexed key, address indexed worker);
    event DeliverySubmitted(bytes32 indexed key, address indexed worker, string deliveryProof);
    event OrderCompleted(bytes32 indexed key, address indexed worker, uint256 workerPayout, uint256 platformFee);
    event OrderRefunded(bytes32 indexed key, address indexed buyer, uint256 amount);
    event OrderDisputed(bytes32 indexed key, address indexed initiator);
    event DisputeResolved(bytes32 indexed key, bool favorWorker);
    event FeeBasisPointsUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event PlatformFeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event PlatformUpdated(address indexed oldPlatform, address indexed newPlatform);

    constructor(address usdcAddress, uint256 initialFeeBps, address feeRecipient, address platformAgent, address initialOwner)
        Ownable(initialOwner)
    {
        require(usdcAddress != address(0), "invalid USDC address");
        require(feeRecipient != address(0), "invalid fee recipient");
        require(initialFeeBps <= 1000, "fee too high");

        usdc = IERC20(usdcAddress);
        feeBasisPoints = initialFeeBps;
        platformFeeRecipient = feeRecipient;
        platform = platformAgent;
    }

    function createOrder(
        string calldata orderId,
        string calldata title,
        string calldata description,
        string calldata sourceMarketplace,
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "amount must be > 0");
        require(bytes(orderId).length > 0, "orderId empty");

        bytes32 key = _orderKey(sourceMarketplace, orderId);
        require(!orderExists[key], "order exists");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        Order storage newOrder = orders[key];
        newOrder.orderId = orderId;
        newOrder.title = title;
        newOrder.description = description;
        newOrder.sourceMarketplace = sourceMarketplace;
        newOrder.amount = amount;
        newOrder.buyer = msg.sender;
        newOrder.worker = address(0);
        newOrder.status = OrderStatus.Open;
        newOrder.createdAt = block.timestamp;

        orderExists[key] = true;
        orderKeys.push(key);

        emit OrderCreated(key, orderId, msg.sender, amount, sourceMarketplace);
    }

    function claimOrder(bytes32 key) external {
        Order storage order = _getExistingOrderStorage(key);
        require(order.status == OrderStatus.Open, "order not open");
        require(msg.sender != order.buyer, "buyer cannot claim");

        order.status = OrderStatus.Claimed;
        order.worker = msg.sender;
        order.claimedAt = block.timestamp;

        emit OrderClaimed(key, msg.sender);
    }

    function submitDelivery(bytes32 key, string calldata deliveryProof) external {
        Order storage order = _getExistingOrderStorage(key);
        require(order.status == OrderStatus.Claimed, "order not claimed");
        require(msg.sender == order.worker, "not worker");

        order.status = OrderStatus.Delivered;
        order.deliveryProof = deliveryProof;
        order.completedAt = block.timestamp;

        emit DeliverySubmitted(key, msg.sender, deliveryProof);
    }

    function confirmDelivery(bytes32 key) external nonReentrant {
        Order storage order = _getExistingOrderStorage(key);
        require(order.status == OrderStatus.Delivered, "order not delivered");
        require(msg.sender == order.buyer || msg.sender == platform, "not buyer or platform");

        (uint256 workerPayout, uint256 platformFee) = _computePayout(order.amount);

        usdc.safeTransfer(order.worker, workerPayout);
        if (platformFee > 0) {
            usdc.safeTransfer(platformFeeRecipient, platformFee);
        }

        order.status = OrderStatus.Completed;

        emit OrderCompleted(key, order.worker, workerPayout, platformFee);
    }

    function refundOrder(bytes32 key) external nonReentrant {
        Order storage order = _getExistingOrderStorage(key);
        require(
            order.status == OrderStatus.Open
                || (order.status == OrderStatus.Claimed && block.timestamp >= order.claimedAt + claimTimeout),
            "not refundable"
        );
        require(msg.sender == order.buyer || msg.sender == platform, "not buyer or platform");

        if (order.status == OrderStatus.Claimed) {
            order.worker = address(0);
        }

        usdc.safeTransfer(order.buyer, order.amount);
        order.status = OrderStatus.Refunded;

        emit OrderRefunded(key, order.buyer, order.amount);
    }

    function disputeOrder(bytes32 key) external {
        Order storage order = _getExistingOrderStorage(key);
        require(
            order.status == OrderStatus.Claimed || order.status == OrderStatus.Delivered,
            "order not disputable"
        );
        require(msg.sender == order.buyer || msg.sender == order.worker, "not participant");

        order.status = OrderStatus.Disputed;

        emit OrderDisputed(key, msg.sender);
    }

    function resolveDispute(bytes32 key, bool favorWorker) external onlyOwner nonReentrant {
        Order storage order = _getExistingOrderStorage(key);
        require(order.status == OrderStatus.Disputed, "order not disputed");

        if (favorWorker) {
            (uint256 workerPayout, uint256 platformFee) = _computePayout(order.amount);

            usdc.safeTransfer(order.worker, workerPayout);
            if (platformFee > 0) {
                usdc.safeTransfer(platformFeeRecipient, platformFee);
            }

            order.status = OrderStatus.Completed;
            emit OrderCompleted(key, order.worker, workerPayout, platformFee);
        } else {
            usdc.safeTransfer(order.buyer, order.amount);
            order.status = OrderStatus.Refunded;
            emit OrderRefunded(key, order.buyer, order.amount);
        }

        emit DisputeResolved(key, favorWorker);
    }

    function setFeeBasisPoints(uint256 bps) external onlyOwner {
        require(bps <= 1000, "fee too high");

        uint256 oldFeeBps = feeBasisPoints;
        feeBasisPoints = bps;

        emit FeeBasisPointsUpdated(oldFeeBps, bps);
    }

    function setClaimTimeout(uint256 seconds_) external onlyOwner {
        require(seconds_ >= 1 hours, "timeout too short");
        require(seconds_ <= 30 days, "timeout too long");

        claimTimeout = seconds_;
    }

    function setPlatformFeeRecipient(address recipient) external onlyOwner {
        require(recipient != address(0), "invalid recipient");

        address oldRecipient = platformFeeRecipient;
        platformFeeRecipient = recipient;

        emit PlatformFeeRecipientUpdated(oldRecipient, recipient);
    }

    function setPlatform(address newPlatform) external onlyOwner {
        address oldPlatform = platform;
        platform = newPlatform;

        emit PlatformUpdated(oldPlatform, newPlatform);
    }

    function getOrder(bytes32 key) external view returns (Order memory) {
        _requireOrderExists(key);
        return orders[key];
    }

    function getOrderByExternalId(string calldata sourceMarketplace, string calldata orderId)
        external
        view
        returns (Order memory)
    {
        bytes32 key = _orderKey(sourceMarketplace, orderId);
        _requireOrderExists(key);
        return orders[key];
    }

    function getOrderCount() external view returns (uint256) {
        return orderKeys.length;
    }

    function getOrderKeys(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        if (offset >= orderKeys.length || limit == 0) {
            return new bytes32[](0);
        }

        uint256 end = offset + limit;
        if (end > orderKeys.length) {
            end = orderKeys.length;
        }

        uint256 size = end - offset;
        bytes32[] memory keys = new bytes32[](size);

        for (uint256 i = 0; i < size; i++) {
            keys[i] = orderKeys[offset + i];
        }

        return keys;
    }

    function getOpenOrders() external view returns (bytes32[] memory) {
        uint256 count;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            if (orders[orderKeys[i]].status == OrderStatus.Open) {
                count++;
            }
        }

        bytes32[] memory keys = new bytes32[](count);
        uint256 index;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            bytes32 key = orderKeys[i];
            if (orders[key].status == OrderStatus.Open) {
                keys[index] = key;
                index++;
            }
        }

        return keys;
    }

    /// @notice Returns up to `limit` open-order keys starting from open-order index `offset`.
    ///         `total` is the total number of open orders (for pagination math client-side).
    function getOpenOrdersPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory keys, uint256 total)
    {
        // First pass: count open orders
        for (uint256 i = 0; i < orderKeys.length; i++) {
            if (orders[orderKeys[i]].status == OrderStatus.Open) {
                total++;
            }
        }

        if (offset >= total || limit == 0) {
            keys = new bytes32[](0);
            return (keys, total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        keys = new bytes32[](end - offset);

        // Second pass: collect the slice
        uint256 openIdx;
        uint256 resultIdx;
        for (uint256 i = 0; i < orderKeys.length; i++) {
            bytes32 key = orderKeys[i];
            if (orders[key].status == OrderStatus.Open) {
                if (openIdx >= offset && openIdx < end) {
                    keys[resultIdx] = key;
                    resultIdx++;
                }
                openIdx++;
                if (openIdx >= end) break;
            }
        }
        return (keys, total);
    }

    function getDeliveredOrders() external view returns (bytes32[] memory) {
        uint256 count;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            if (orders[orderKeys[i]].status == OrderStatus.Delivered) {
                count++;
            }
        }

        bytes32[] memory keys = new bytes32[](count);
        uint256 index;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            bytes32 key = orderKeys[i];
            if (orders[key].status == OrderStatus.Delivered) {
                keys[index] = key;
                index++;
            }
        }

        return keys;
    }

    function getClaimedOrders() external view returns (bytes32[] memory) {
        uint256 count;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            if (orders[orderKeys[i]].status == OrderStatus.Claimed) {
                count++;
            }
        }

        bytes32[] memory keys = new bytes32[](count);
        uint256 index;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            bytes32 key = orderKeys[i];
            if (orders[key].status == OrderStatus.Claimed) {
                keys[index] = key;
                index++;
            }
        }

        return keys;
    }

    function getDisputedOrders() external view returns (bytes32[] memory) {
        uint256 count;
        for (uint256 i = 0; i < orderKeys.length; i++) {
            if (orders[orderKeys[i]].status == OrderStatus.Disputed) {
                count++;
            }
        }
        bytes32[] memory keys = new bytes32[](count);
        uint256 idx;
        for (uint256 i = 0; i < orderKeys.length; i++) {
            bytes32 key = orderKeys[i];
            if (orders[key].status == OrderStatus.Disputed) {
                keys[idx] = key;
                idx++;
            }
        }
        return keys;
    }

    function getOrdersByWorker(address worker) external view returns (bytes32[] memory) {
        uint256 count;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            if (orders[orderKeys[i]].worker == worker) {
                count++;
            }
        }

        bytes32[] memory keys = new bytes32[](count);
        uint256 index;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            bytes32 key = orderKeys[i];
            if (orders[key].worker == worker) {
                keys[index] = key;
                index++;
            }
        }

        return keys;
    }

    function getOrdersByBuyer(address buyer) external view returns (bytes32[] memory) {
        uint256 count;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            if (orders[orderKeys[i]].buyer == buyer) {
                count++;
            }
        }

        bytes32[] memory keys = new bytes32[](count);
        uint256 index;

        for (uint256 i = 0; i < orderKeys.length; i++) {
            bytes32 key = orderKeys[i];
            if (orders[key].buyer == buyer) {
                keys[index] = key;
                index++;
            }
        }

        return keys;
    }

    function _computePayout(uint256 amount) internal view returns (uint256 workerPayout, uint256 platformFee) {
        platformFee = (amount * feeBasisPoints) / 10_000;
        workerPayout = amount - platformFee;
    }

    function _orderKey(string memory sourceMarketplace, string memory orderId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(sourceMarketplace, ":", orderId));
    }

    function _getExistingOrderStorage(bytes32 key) internal view returns (Order storage order) {
        _requireOrderExists(key);
        return orders[key];
    }

    function _requireOrderExists(bytes32 key) internal view {
        require(orderExists[key], "order not found");
    }
}
