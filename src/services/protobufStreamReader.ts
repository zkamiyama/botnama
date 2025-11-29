// Length-Delimited Protobuf Stream Reader
// Based on https://github.com/tsukumijima/NDGRClient protobuf_stream_reader.py

export class ProtobufStreamReader {
    private reader: ReadableStreamDefaultReader<Uint8Array>;
    private buffer: Uint8Array;
    private position: number;

    constructor(stream: ReadableStream<Uint8Array>) {
        this.reader = stream.getReader();
        this.buffer = new Uint8Array(0);
        this.position = 0;
    }

    /**
     * Read a single byte from the stream
     */
    private async readByte(): Promise<number | null> {
        // If we've consumed all buffered data, read more from stream
        if (this.position >= this.buffer.length) {
            const { done, value } = await this.reader.read();
            if (done) {
                return null;
            }
            this.buffer = value;
            this.position = 0;
        }

        return this.buffer[this.position++];
    }

    /**
     * Read exact number of bytes from the stream
     */
    private async readBytes(length: number): Promise<Uint8Array | null> {
        const result = new Uint8Array(length);
        let offset = 0;

        while (offset < length) {
            // Check if we have buffered data
            const available = this.buffer.length - this.position;

            if (available > 0) {
                // Copy from buffer
                const toCopy = Math.min(available, length - offset);
                result.set(this.buffer.subarray(this.position, this.position + toCopy), offset);
                this.position += toCopy;
                offset += toCopy;
            } else {
                // Read more from stream
                const { done, value } = await this.reader.read();
                if (done) {
                    return offset > 0 ? result.subarray(0, offset) : null;
                }
                this.buffer = value;
                this.position = 0;
            }
        }

        return result;
    }

    /**
     * Read a varint (variable-length integer) from the stream
     * Returns the decoded integer or null if stream ended
     */
    private async readVarint(): Promise<number | null> {
        let value = 0;
        let shift = 0;

        while (true) {
            const byte = await this.readByte();
            if (byte === null) {
                return null;
            }

            // Add the lower 7 bits to the result
            value |= (byte & 0x7F) << shift;

            // If MSB is 0, this is the last byte
            if ((byte & 0x80) === 0) {
                break;
            }

            shift += 7;

            // Prevent overflow for extremely large varints
            if (shift > 63) {
                throw new Error("Varint too large");
            }
        }

        return value;
    }

    /**
     * Read messages from a Length-Delimited Protobuf stream
     * Each message is prefixed with a varint indicating its length
     */
    async *readMessages(): AsyncGenerator<Uint8Array> {
        while (true) {
            // Read the length prefix
            const length = await this.readVarint();
            if (length === null) {
                break; // End of stream
            }

            // Read the message bytes
            const messageBytes = await this.readBytes(length);
            if (messageBytes === null || messageBytes.length < length) {
                break; // Unexpected end of stream
            }

            yield messageBytes;
        }
    }

    /**
     * Close the reader
     */
    async close(): Promise<void> {
        await this.reader.cancel();
    }
}
