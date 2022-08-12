# Dynamo Event Emitter

Service calls with multiple non-transactional state changes can be problematic.  When such a call fails midway through, it can be difficult to ascertain what state the overall system is in.

Limiting service calls to making a single state-changing transaction helps keep things simple as stateful resources are resilient against outages.  Once state is persisted, processing can continue by polling the stateful resource or processing events.

## Use case
Being able to emit events on a CRUD-type DynamoDB service.  I.e. Which attributes changed and when?  E.g. A user changing their phone number, name or some type of status.

## DynamoDB Stream types
DynamoDB supports [two types of streaming mechanisms](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/streamsmain.html): 
- Amazon Kinesis data streams
- DynamoDB streams

Kinesis is an excellent mechanism for bulk processing records, particularly when all records are created equally and should be treated in the same manner.  However it doesn't support routing.  So, in the above use case, in order for a service to process changes to a user's phone number, it would need to consume all user events.

DynamoDB streams send batches of changes to a Lambda function (or functions) for processing.  This has the same limitation as Kinesis streams in that there's no routing, but also doesn't serve as a clean interface between services.

## EventBridge
[AWS EventBridge](https://aws.amazon.com/eventbridge/) is a fully managed, serverless, event routing service with implicit scalability. Routing allows producers to be completely decoupled from consumers, because producers can publish to a bus and consumers can subscribe to the exact messages they want.

## CRUD Events
![Event Emitter Diagram](event-emitter.svg)

The `DynamoEventEmitter` construct provisions a Lambda function, IAM role and trigger for the specified table.
*Note: The table requires a DynamoDB Stream with NEW_AND_OLD_IMAGES*

### Event format
```
{
    "Source": STRING,
    "DetailType": INSERT | MODIFY | REMOVE,
    "Detail:": {
        "Values": JSON,
        "UpdatedFields": [STRING, ...]
    }
}
```
- **Source:** The name of the table.  *TODO:  Should this be specified as a parameter to avoid services having to handle table prefixes?*
- **DetailType:** The action that triggered the event (INSERT, MODIFY or DELETE)
- **Values:** The NEW_IMAGE of the DynamoDB record, expressed as a JSON
- **UpdatedFields:** In the case of a MODIFY or INSERT, this will contain the names of the attributes which have been updated.

This allows the creation of EventBridge rules to act of changes to specific attributes.

#### Example Rule
```
{
    source: ["user-table"],
    detail-type: ["MODIFY"],
    detail: {
        UpdatedFields: ["phone-number"]   // TODO:  Check and see if this works.  UpdatedFields might have to be an object.
    }
}
```
@see [Amazon EventBridge event patterns](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html)

## Accreditations
- [Amazon EventBridge Custom Event Bus Example](https://towardsaws.com/amazon-eventbridge-custom-event-bus-example-8f88ccb9766)
- [Combining the Best of AWS EventBridge and AWS Kinesis](https://medium.com/@jgilbert001/combining-the-best-of-aws-eventbridge-and-aws-kinesis-9b363b043ade)