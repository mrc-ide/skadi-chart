import { shallowMount } from "@vue/test-utils";
import Cowsay from "@/components/Cowsay.vue";

describe("Cowsay", () => {
    const getWrapper = (cowSays: string) => {
        return shallowMount(Cowsay, { props: { cowSays } })
    }

    it("works", () => {
        const noise = "moo";
        const wrapper = getWrapper(noise);
        expect(wrapper.text()).toBe(`Cowsays: ${noise}`);
    });
});